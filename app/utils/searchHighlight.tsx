import React from 'react';

export interface HighlightSearchTermOptions {
  isSelected?: boolean;
  className?: string;
  messageType?: 'user' | 'assistant' | 'default';
}

/**
 * 🚀 FEATURE: Unified search term highlighting utility
 * Highlights search terms in text with multilingual support
 * 
 * @param text - The text to highlight
 * @param term - The search term(s) to highlight
 * @param options - Optional styling and behavior options
 * @returns JSX element with highlighted terms or original text
 */
export const highlightSearchTerm = (
  text: string, 
  term: string | null, 
  options: HighlightSearchTermOptions = {}
): React.ReactNode => {
  if (!term || !term.trim() || !text) return text;

  const { isSelected = false, className, messageType = 'default' } = options;

  // Split search term into words and escape for regex
  const searchWords = term.trim().toLowerCase().split(/\s+/).filter(word => word.length > 0);
  const escapedWords = searchWords.map(word =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  
  if (escapedWords.length === 0) return text;

  const regex = new RegExp(`(${escapedWords.join('|')})`, 'giu');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    // Check if the part matches any of the search words (case-insensitive)
    const isMatch = escapedWords.some(word => new RegExp(`^${word}$`, 'i').test(part));
    
    if (isMatch) {
      // Determine highlight styles based on context
      let highlightClass = 'px-0.5 rounded font-medium transition-colors';
      
      if (className) {
        highlightClass += ` ${className}`;
      } else if (isSelected) {
        // For selected items (like in sidebar)
        highlightClass += ' bg-white/30 text-white text-xs';
      } else {
        // Apply different highlighting based on message type
        switch (messageType) {
          case 'user':
            // For user messages (blue background), use yellow/orange highlight
            highlightClass += ' bg-yellow-400/80 text-black dark:bg-orange-400/80 dark:text-black';
            break;
          case 'assistant':
            // For assistant messages (gray background), use blue highlight
            highlightClass += ' bg-[#007AFF]/20 text-[#007AFF] dark:bg-[#007AFF]/30 dark:text-[#58a6ff]';
            break;
          default:
            // Default blue highlighting
            highlightClass += ' bg-[#007AFF]/20 text-[#007AFF] dark:bg-[#007AFF]/30 dark:text-[#58a6ff]';
        }
      }

      return (
        <span
          key={index}
          className={highlightClass}
        >
          {part}
        </span>
      );
    }
    return part;
  });
};

/**
 * 🚀 FEATURE: Enhanced React children highlighting utility
 * Recursively processes React children to highlight search terms in text nodes
 * 
 * @param children - React children to process
 * @param term - The search term(s) to highlight
 * @param options - Optional styling and behavior options
 * @returns Processed React children with highlighted terms
 */
export const highlightSearchTermInChildren = (
  children: React.ReactNode, 
  term: string | null, 
  options: HighlightSearchTermOptions = {}
): React.ReactNode => {
  if (!term || !term.trim()) return children;

  const processNode = (node: React.ReactNode): React.ReactNode => {
    // Handle string nodes
    if (typeof node === 'string') {
      return highlightSearchTerm(node, term, options);
    }

    // Handle number nodes
    if (typeof node === 'number') {
      return highlightSearchTerm(node.toString(), term, options);
    }

    // Handle React elements
    if (React.isValidElement(node)) {
      // Don't process code blocks, links, or already highlighted elements
      if (
        node.type === 'code' ||
        node.type === 'a' ||
        (typeof node.type === 'string' && node.type === 'span' && 
         (node.props as any)?.className?.includes('bg-[#007AFF]/20'))
      ) {
        return node;
      }

      // Process children recursively
      const processedChildren = React.Children.map((node.props as any)?.children, processNode);
      
      return React.cloneElement(node, {
        ...(node.props as any),
        children: processedChildren
      });
    }

    // Handle arrays
    if (Array.isArray(node)) {
      return node.map((child, index) => (
        <React.Fragment key={index}>
          {processNode(child)}
        </React.Fragment>
      ));
    }

    return node;
  };

  return processNode(children);
};

/**
 * 🚀 FEATURE: Text extractor utility
 * Extracts plain text from React children for search purposes
 * 
 * @param node - React node to extract text from
 * @returns Plain text string
 */
export const extractTextFromChildren = (node: React.ReactNode): string => {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return node.toString();
  
  if (React.isValidElement(node)) {
    return extractTextFromChildren((node.props as any)?.children);
  }
  
  if (Array.isArray(node)) {
    return node.map(extractTextFromChildren).join('');
  }
  
  return '';
};

/**
 * 🚀 PERFORMANCE: Memoized version for heavy usage
 * Use this when the highlighting function is called frequently
 */
export const highlightSearchTermMemo = React.memo(
  ({ text, term, options }: { 
    text: string; 
    term: string | null; 
    options?: HighlightSearchTermOptions 
  }) => {
    return <>{highlightSearchTerm(text, term, options)}</>;
  }
);
