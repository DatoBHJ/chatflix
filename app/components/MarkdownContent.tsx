import { useState, useMemo, memo, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Add global styles for LaTeX rendering
// This should be added to your global CSS file
const addKatexStyles = () => {
  if (typeof document !== 'undefined') {
    // Only run in browser environment
    const styleId = 'katex-custom-styles';
    
    // Check if style already exists to avoid duplicates
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        /* Base KaTeX styling */
        .katex { 
          font-size: 1.1em !important; 
          font-family: KaTeX_Main, 'Times New Roman', serif;
        }
        
        /* Display math (block equations) */
        .katex-display { 
          margin: 1.5em 0 !important;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 0;
          background: rgba(0, 0, 0, 0.02);
          border-radius: 4px;
        }
        .katex-display > .katex { 
          font-size: 1.21em !important;
          text-align: center;
        }
        
        /* Inline math */
        .katex-inline {
          padding: 0 3px;
        }
        
        /* Better spacing for fraction lines */
        .katex .frac-line {
          border-bottom-width: 0.1em !important;
        }
        
        /* Better matrices */
        .katex .mathnormal {
          font-style: normal;
        }
        
        /* Improved spacing in matrices */
        .katex .mord.matrix {
          margin: 0.1em 0;
        }
        
        /* Better vector arrows */
        .katex .vec-arrow {
          position: relative;
          top: -0.1em !important;
        }
        
        /* Improved subscript and superscript spacing */
        .katex .msupsub {
          text-align: left;
        }
        
        /* Improve display of cases environment */
        .katex .cases-l {
          margin-right: 0.2em !important;
        }
        .katex .cases-r {
          margin-left: 0.2em !important;
        }
        
        /* Improve alignment in align environment */
        .katex .align {
          display: flex;
          flex-direction: column;
        }
        
        /* Improve multiline equations */
        .katex-display .katex .base {
          margin: 0.25em 0;
        }
        
        /* Improve integral appearance */
        .katex .mop-limits {
          margin-top: 0.1em !important;
        }
      `;
      document.head.appendChild(style);
    }
  }
};

// Helper function to escape dollar signs in currency strings but leave math intact
function escapeCurrencyDollars(text: string): string {
  // Enhanced check for undefined or null - return empty string for any falsy value
  if (text === undefined || text === null || text === '') return '';
  
  // Don't process if no dollar sign
  if (!text.includes('$')) return text;
  
  // Store math expressions to protect them
  const mathExpressions: string[] = [];
  
  // First, protect block math ($$...$$) including multi-line expressions
  let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    mathExpressions.push(match);
    return `__BLOCK_MATH_${mathExpressions.length - 1}__`;
  });
  
  // Then identify and protect ONLY CLEAR math expressions with unambiguous math syntax
  // This pattern is much more strict about what it considers math - must have clear math operators
  const strictMathPattern = /\$((?:[^$]|\\\$)*?(?:[+\-*\/^=<>~]|\\[a-zA-Z]{2,}|\\(?:sum|int|frac|sqrt|lim|infty))[^$]*?)\$/g;
  processedText = processedText.replace(strictMathPattern, (match) => {
    mathExpressions.push(match);
    return `__INLINE_MATH_${mathExpressions.length - 1}__`;
  });
  
  // Now aggressively handle ALL currency and number patterns
  
  // 1. Dollar sign followed by digits (with optional comma/period) - most common currency case
  processedText = processedText.replace(/\$\s*[\d,\.]+/g, (match) => {
    return match.replace('$', '&#36;');
  });
  
  // 2. Dollar amounts with text immediately after, or parentheses ($73,950median, $73,950(median))
  processedText = processedText.replace(/\$[\d,\.]+\s*(?:\([a-zA-Z\s]+\)|[a-zA-Z]+)/g, (match) => {
    return match.replace('$', '&#36;');
  });
  
  // 3. Handle specific case with "to" between amounts ($73,950to$75,400)
  processedText = processedText.replace(/\$[\d,\.]+\s*(?:to|-)\s*\$[\d,\.]+/g, (match) => {
    return match.replace(/\$/g, '&#36;');
  });
  
  // 4. Catch any remaining dollar sign with numbers that wasn't caught as math
  processedText = processedText.replace(/\$(?!\s*[a-zA-Z\\{}_^])([\d,\.\s]+)/g, (match, p1) => {
    return '&#36;' + p1;
  });
  
  // Restore math expressions in reverse order to avoid nested placeholder issues
  for (let i = mathExpressions.length - 1; i >= 0; i--) {
    processedText = processedText
      .replace(`__INLINE_MATH_${i}__`, mathExpressions[i])
      .replace(`__BLOCK_MATH_${i}__`, mathExpressions[i]);
  }
  
  return processedText;
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

// Memoize the MarkdownContent component to prevent unnecessary re-renders
export const MarkdownContent = memo(function MarkdownContentComponent({ content }: MarkdownContentProps) {
  // Add Katex styles on component mount
  useEffect(() => {
    addKatexStyles();
  }, []);

  // Pre-process the content to escape currency dollar signs
  const processedContent = useMemo(() => {
    return escapeCurrencyDollars(content);
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
    p: ({ children, ...props }) => {
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
      
      const codeText = extractText(children);
      
      return (
        <div className="message-code group relative my-6 max-w-full overflow-hidden">
          <div className="message-code-header flex items-center justify-between px-4 py-2">
            <span className="text-xs uppercase tracking-wider text-[var(--muted)] break-all">
              {match?.[1] || 'text'}
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
      <ul className="list-disc list-inside space-y-2 my-4 ml-4" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-inside space-y-2 my-4 ml-4" {...props}>
        {children}
      </ol>
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
  }), [styleMentions, styleImageUrls, extractText, handleCopy]);

  // Memoize the remarkPlugins and rehypePlugins
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  
  // Updated rehypePlugins with enhanced configuration
  const rehypePlugins = useMemo(() => {
    const plugins = [
      rehypeRaw, 
      rehypeSanitize,
      rehypeHighlight,
      // Enhance KaTeX configuration for better math rendering
      [rehypeKatex, { 
        throwOnError: false,
        output: 'html',
        displayMode: false,
        trust: true,
        strict: false,
        macros: {
          // Common mathematical sets
          "\\R": "\\mathbb{R}",
          "\\N": "\\mathbb{N}",
          "\\Z": "\\mathbb{Z}",
          "\\C": "\\mathbb{C}",
          "\\Q": "\\mathbb{Q}",
          
          // Vector notation
          "\\vec": "\\boldsymbol",
          "\\vb": "\\boldsymbol",
          "\\grad": "\\nabla",
          
          // Differential operators
          "\\pd": "\\partial",
          "\\d": "\\mathrm{d}",
          "\\dd": "\\mathrm{d}",
          "\\div": "\\nabla \\cdot",
          "\\curl": "\\nabla \\times",
          "\\laplacian": "\\nabla^2",
          
          // Common constants
          "\\e": "\\mathrm{e}",
          "\\i": "\\mathrm{i}",
          "\\j": "\\mathrm{j}",
          
          // Probability and statistics
          "\\E": "\\mathbb{E}",
          "\\Var": "\\text{Var}",
          "\\Cov": "\\text{Cov}",
          "\\Prob": "\\mathbb{P}",
          
          // Shortcuts for common constructs
          "\\half": "\\frac{1}{2}",
          "\\third": "\\frac{1}{3}",
          "\\quarter": "\\frac{1}{4}",
          
          // Matrix notation
          "\\mat": "\\mathbf",
          "\\bmat": "\\begin{bmatrix}#1\\end{bmatrix}",
          "\\pmat": "\\begin{pmatrix}#1\\end{pmatrix}",
          "\\vmat": "\\begin{vmatrix}#1\\end{vmatrix}",
          
          // Quantum mechanics
          "\\ket": "\\left|#1\\right\\rangle",
          "\\bra": "\\left\\langle#1\\right|",
          "\\braket": "\\left\\langle#1|#2\\right\\rangle",
          
          // Calculus shorthands
          "\\dv": "\\frac{d}{d#1}",
          "\\pdv": "\\frac{\\partial}{\\partial #1}"
        },
        errorColor: '#ff5555',
        minRuleThickness: 0.08,
        colorIsTextColor: true,
        maxExpand: 1000,
        maxSize: 500
      }] as any
    ];
    return plugins;
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