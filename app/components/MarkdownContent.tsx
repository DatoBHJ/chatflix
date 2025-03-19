import { useState, useMemo, memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
}

// 이미지 컴포넌트를 분리하여 로딩 상태를 관리
const ImageWithLoading = memo(({ src, alt, className, ...props }: { src: string, alt?: string, className?: string, [key: string]: any }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // 이미지 로드 완료 핸들러
  const handleImageLoaded = () => {
    setIsLoading(false);
  };

  // 이미지 로드 에러 핸들러
  const handleImageError = () => {
    setIsLoading(false);
    setError(true);
  };

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent)] bg-opacity-20 rounded-lg">
          <div className="flex flex-col items-center justify-center p-4">
            <div className="w-8 h-8 border-4 border-[var(--muted)] border-t-[var(--foreground)] rounded-full animate-spin mb-2"></div>
            <div className="text-xs text-[var(--muted)]">Loading image...</div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--accent)] bg-opacity-20 rounded-lg">
          <div className="text-center p-4">
            <div className="text-sm text-[var(--foreground)]">Unable to load image</div>
            <div className="text-xs text-[var(--muted)] mt-1">Click the link to open directly</div>
          </div>
        </div>
      )}
      
      <img 
        src={src} 
        alt={alt || "Generated image"} 
        className={`${className || 'rounded-lg max-w-full'} ${isLoading ? 'min-h-[200px]' : ''}`}
        onLoad={handleImageLoaded}
        onError={handleImageError}
        {...props} 
      />
    </div>
  );
});

// Memoize the MarkdownContent component to prevent unnecessary re-renders
export const MarkdownContent = memo(function MarkdownContentComponent({ content }: MarkdownContentProps) {
  const [copied, setCopied] = useState<{[key: string]: boolean}>({});

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
    
    // Detect full pollinations.ai URLs in text
    const pollinationsUrlRegex = /(https:\/\/image\.pollinations\.ai\/prompt\/[^\s]+)/g;
    
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
      parts.push(
        <span key={match.index} className="block my-4">
          <a 
            href={decodedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <ImageWithLoading src={decodedUrl} alt="Generated image" className="rounded-lg max-w-full hover:opacity-90 transition-opacity cursor-pointer border border-[var(--accent)] shadow-md" />
            <div className="text-xs text-[var(--muted)] mt-2 text-center break-all">
              {decodedUrl}
            </div>
          </a>
        </span>
      );
      
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

  // Memoize the components object to avoid recreating it on every render
  const components = useMemo<Components>(() => ({
    p: ({ children, ...props }) => {
      // Process text content to detect image generation links
      if (typeof children === 'string') {
        // Check for image pollinations link pattern
        const pollinationsRegex = /!\[([^\]]+)\]\((https:\/\/image\.pollinations\.ai\/prompt\/[^)]+\?width=\d+&height=\d+)[^)]*\)/g;
        const match = pollinationsRegex.exec(children);
        
        if (match) {
          const [fullMatch, altText, imageUrl] = match;
          const decodedUrl = decodeURIComponent(imageUrl);
          
          // Return a clickable image with link
          // Using a div at the root to avoid nesting p inside p
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
        
        // Process for raw image URLs first, then apply mention styling
        const processedContent = styleImageUrls(children);
        if (processedContent !== children) {
          // If URLs were replaced, render the processed content
          return <div className="my-3 leading-relaxed" {...props}>{processedContent}</div>;
        }
        
        // Handle plain text with styleMentions for regular paragraphs
        return <p className="my-3 leading-relaxed" {...props}>{styleMentions(children)}</p>;
      }
      return <p className="my-3 leading-relaxed" {...props}>{children}</p>;
    },
    img: ({ src, alt, ...props }) => {
      // Check if it's a pollinations.ai image URL
      if (src && src.includes('image.pollinations.ai/prompt')) {
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
      
      const codeText = extractText(children);
      
      if (isInline) {
        return (
          <code className="font-mono text-sm bg-[var(--inline-code-bg)] text-[var(--inline-code-text)] px-1.5 py-0.5 rounded" {...props}>
            {children}
          </code>
        );
      }
      
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
  }), [styleMentions, styleImageUrls, extractText, handleCopy, copied]);

  // Memoize the plugins to avoid recreating them on every render
  const remarkPlugins = useMemo(() => [remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeRaw, rehypeSanitize, rehypeHighlight], []);

  return (
    <ReactMarkdown
      className="message-content"
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}); 