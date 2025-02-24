import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const [copied, setCopied] = useState<{[key: string]: boolean}>({});

  const handleCopy = async (text: string) => {
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
  };

  const styleMentions = (text: string) => {
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
  };

  const extractText = (node: any): string => {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node?.props?.children) return extractText(node.props.children);
    return '';
  };

  return (
    <ReactMarkdown
      className="message-content"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
      components={{
        p: ({ children }) => {
          if (typeof children === 'string') {
            return <p className="my-3 leading-relaxed">{styleMentions(children)}</p>;
          }
          return <p className="my-3 leading-relaxed">{children}</p>;
        },
        a: ({ href, children }) => (
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-[var(--foreground)] border-b border-[var(--muted)] hover:border-[var(--foreground)] transition-colors"
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }: any) => {
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
        table: ({ children }) => (
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="bg-[var(--accent)] font-medium text-[var(--muted)] uppercase tracking-wider p-3 border border-[var(--accent)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="p-3 border border-[var(--accent)]">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[var(--muted)] pl-4 my-6 text-[var(--muted)] italic">
            {children}
          </blockquote>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-2 my-4 ml-4">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-2 my-4 ml-4">
            {children}
          </ol>
        ),
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold mt-5 mb-2">{children}</h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
} 