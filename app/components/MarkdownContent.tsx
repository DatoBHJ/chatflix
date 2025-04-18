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
        <p>Invalid image URL</p>
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
            
            {/* 로딩 텍스트 */}
            <p className="text-[var(--muted)] text-sm font-medium">
              Loading image... {loadingProgress}%
            </p>
            
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
          <p className="mb-1">Image failed to load</p>
          {alt && <p className="text-sm italic mb-2 opacity-75">{alt}</p>}
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
  const [copied, setCopied] = useState<{[key: string]: boolean}>({});

  // 수식 표현이 있는지 확인하는 함수
  const hasMathExpression = useCallback((text: string) => {
    // 수학 수식, 화학식, 물리량 표현 감지 (패턴 확장)
    return /\$(.*?)\$|\$\$(.*?)\$\$|\\ce\{.*?\}|\\SI\{.*?\}\{.*?\}|\\begin\{(equation|align|matrix|pmatrix|bmatrix|cases)\}|\\frac\{.*?\}\{.*?\}|\\sum|\\int/g.test(text);
  }, []);

  // 수식 표현을 처리하는 함수 (inline/block 수식, 화학식, 물리량)
  const processMathExpressions = useCallback((text: string) => {
    if (!hasMathExpression(text)) return text;
    
    // 블록 수식이 제대로 표시되도록 변환 ($$...$$)
    let processed = text.replace(/\$\$(.*?)\$\$/gs, (match, p1) => {
      // 줄바꿈이 있으면 displayMode로 처리하기 위해 특별 마커 추가
      if (p1.includes('\n')) {
        return `\n\n$$${p1}$$\n\n`;
      }
      return match;
    });
    
    // 화학식 변환 처리 (만약 화학식이 처리되지 않는 경우 사용)
    // \ce{...} -> $\ce{...}$
    processed = processed.replace(/\\ce\{(.*?)\}/g, (match, p1) => {
      return `$\\ce{${p1}}$`;
    });
    
    // 물리량 변환 처리 (만약 SI 단위가 처리되지 않는 경우 사용)
    // \SI{...}{...} -> $\SI{...}{...}$
    processed = processed.replace(/\\SI\{(.*?)\}\{(.*?)\}/g, (match, p1, p2) => {
      return `$\\SI{${p1}}{${p2}}$`;
    });
    
    // 분수 표현 처리 개선
    processed = processed.replace(/\\frac\{(.*?)\}\{(.*?)\}/g, (match) => {
      if (!match.startsWith('$')) {
        return `$${match}$`;
      }
      return match;
    });
    
    // 특수 수학 기호 처리 (백틱으로 감싸져 있지 않은 경우만)
    processed = processed.replace(/(?<!\`)(\\sum|\\int|\\prod|\\lim)(?!\`)/g, (match) => {
      if (!match.startsWith('$')) {
        return `$${match}$`;
      }
      return match;
    });
    
    return processed;
  }, [hasMathExpression]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      const cleanText = typeof text === 'string' 
        ? text.replace(/\u200B/g, '').trim()
        : '';
        
      await navigator.clipboard.writeText(cleanText);
      setCopied(prev => ({ ...prev, [text]: true }));
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [text]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  }, []);

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

  // Function to detect and convert plain image URLs to clickable images
  const styleImageUrls = useCallback((text: string) => {
    if (!text.includes('image.pollinations.ai')) return text; // Quick check to avoid unnecessary regex processing
    
    // Detect any pollinations.ai URLs in text (확장된 정규식)
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
      
      // Create a link that includes the actual image with loading state
      // Instead of returning a span with divs inside (which would cause issues when rendered in a p tag),
      // we'll signal that this needs special handling at the component level
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
  
  // 인라인 코드에 수식이 있는지 확인하고 처리하는 함수 추가
  const processInlineCode = useCallback((children: any) => {
    if (typeof children !== 'string') return children;
    
    // 인라인 코드에 수식 표현이 있는지 확인
    if (hasMathExpression(children)) {
      // KaTeX로 렌더링하기 위해 마크다운 형식으로 변환
      return processMathExpressions(children);
    }
    
    return children;
  }, [hasMathExpression, processMathExpressions]);

  // Memoize the components object to avoid recreating it on every render
  const components = useMemo<Components>(() => ({
    p: ({ children, ...props }) => {
      // Process text content to detect image generation links
      if (typeof children === 'string') {
        // 두 가지 형식의 이미지 URL 패턴을 모두 처리합니다:
        // 1. ![alt](url) 형식의 표준 마크다운 이미지
        // 2. 일반 URL 텍스트 형식으로 제공되는 이미지
        
        // 이미지 마크다운 패턴 감지 (개선된 정규식)
        const pollinationsRegex = /!\[([^\]]*)\]\((https:\/\/image\.pollinations\.ai\/[^)]+)\)/g;
        const match = pollinationsRegex.exec(children);
        
        if (match) {
          const [fullMatch, altText, imageUrl] = match;
          const decodedUrl = decodeURIComponent(imageUrl);
          
          // 반환된 이미지에 CORS 이슈가 있을 수 있으므로 referrerPolicy를 설정합니다
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
        
        // 직접 URL로만 제공되는 이미지 처리 (image.pollinations.ai 포함)
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
        
        // 인라인 수식 처리 (` $ ` 패턴 감지)
        if (hasMathExpression(children)) {
          try {
            const processedText = processMathExpressions(children);
            return <p className="my-3 leading-relaxed" {...props}>{processedText}</p>;
          } catch (e) {
            console.error('Failed to process math expression:', e);
          }
        }
        
        // Process for raw image URLs (그 외의 패턴 처리)
        const processedContent = styleImageUrls(children);
        
        // Check if we got back an array with image links that need special handling
        if (Array.isArray(processedContent)) {
          // We need to render each part appropriately
          const elements = processedContent.map((part, index) => {
            if (typeof part === 'string') {
              return <span key={index}>{styleMentions(part)}</span>;
            } else if (part && typeof part === 'object' && 'type' in part && part.type === 'image_link') {
              // This is our special image link that shouldn't be inside a p tag
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
          
          // Return a fragment instead of a p to avoid nesting issues
          return <>{elements}</>;
        }
        
        // Handle plain text with styleMentions for regular paragraphs
        return <p className="my-3 leading-relaxed" {...props}>{styleMentions(children)}</p>;
      }
      
      // If children is not a string, we need to be careful about potential nesting issues
      if (Array.isArray(children)) {
        // Check if any of the children would cause invalid nesting
        const hasComplexChildren = children.some(child => 
          typeof child === 'object' && 
          child !== null && 
          'type' in child && 
          (typeof child.type === 'string' && 
           ['div', 'p', 'table', 'ul', 'ol', 'blockquote'].includes(child.type as string))
        );
        
        if (hasComplexChildren) {
          // Use a fragment to avoid invalid nesting
          return <>{children}</>;
        }
      }
      
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
      
      // 수식 표현이 있는 인라인 코드인 경우 특별하게 처리
      if (isInline) {
        const processedChildren = processInlineCode(children);
        if (processedChildren !== children) {
          // 수식 콘텐츠를 포함하는 코드에 대한 특별 스타일링
          return (
            <span className="math-inline">
              {processedChildren}
            </span>
          );
        }
        // 일반 인라인 코드 처리는 그대로 유지
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
              onClick={() => handleCopy(codeText)}
              className="text-xs uppercase tracking-wider px-2 py-1 
                       text-[var(--muted)] hover:text-[var(--foreground)] 
                       transition-colors flex items-center gap-1 whitespace-nowrap ml-2"
            >
              {copied[codeText] ? (
                <>
                  <span className="">Copied</span>
                </>
              ) : (
                <>Copy</>
              )}
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
  }), [styleMentions, styleImageUrls, extractText, handleCopy, copied, processInlineCode, hasMathExpression, processMathExpressions]);

  // Memoize the plugins to avoid recreating them on every render
  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => {
    return [
      rehypeRaw, 
      rehypeSanitize,
      [rehypeKatex, { 
        throwOnError: false, 
        output: 'html',
        displayMode: false, // 인라인 수식용 기본 설정
        leqno: false, // 왼쪽 정렬된 방정식 번호
        fleqn: false, // 왼쪽 정렬된 디스플레이 수식
        strict: false, // 문법 오류에 대해 엄격하지 않게 처리
        trust: true, // 특수 KaTeX 확장 허용
        errorColor: 'var(--muted)', // 오류 시 색상
        minRuleThickness: 0.08, // 분수 선 두께 개선
        macros: { // 사용자 정의 매크로
          // 수학 기호
          "\\R": "\\mathbb{R}",
          "\\N": "\\mathbb{N}",
          "\\Z": "\\mathbb{Z}",
          "\\C": "\\mathbb{C}",
          // 벡터 표기 간소화
          "\\vec": "\\boldsymbol",
          "\\vb": "\\boldsymbol",
          // 편미분 기호
          "\\pd": "\\partial",
          // 화학식 지원
          "\\ch": "\\ce",
          // 물리 단위 지원
          "\\unit": "\\text",
          // 일반적인 수학 기호
          "\\half": "\\frac{1}{2}",
          "\\third": "\\frac{1}{3}",
          "\\quarter": "\\frac{1}{4}",
          "\\e": "\\mathrm{e}",
          "\\i": "\\mathrm{i}",
          "\\d": "\\mathrm{d}",
          // 행렬 매크로
          "\\bmat": "\\begin{bmatrix}#1\\end{bmatrix}",
          "\\pmat": "\\begin{pmatrix}#1\\end{pmatrix}",
          // 미분 연산자
          "\\dx": "\\,\\mathrm{d}x",
          "\\dy": "\\,\\mathrm{d}y",
          "\\dz": "\\,\\mathrm{d}z",
          "\\dt": "\\,\\mathrm{d}t",
          // 기타 유용한 매크로
          "\\norm": "\\left\\lVert#1\\right\\rVert",
          "\\abs": "\\left|#1\\right|",
        },
      }],
      rehypeHighlight
    ] as any;
  }, []);

  // Process the content to handle math expressions
  const processedContent = useMemo(() => {
    return processMathExpressions(content);
  }, [content, processMathExpressions]);

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