import React, { useState, useEffect, useMemo } from 'react';

// Props for the MathJaxEquation component
interface MathJaxEquationProps {
  equation: string;
  display?: boolean;
}

// Simple check for browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Load MathJax script only once
 */
let mathJaxPromise: Promise<any> | null = null;
const loadMathJax = () => {
  if (!mathJaxPromise) {
    mathJaxPromise = new Promise<void>((resolve) => {
      // Skip in SSR
      if (!isBrowser) {
        resolve();
        return;
      }
      
      // If MathJax is already loaded, resolve immediately
      if ((window as any).MathJax) {
        resolve();
        return;
      }

      // Set up MathJax config
      (window as any).MathJax = {
        options: {
          enableMenu: false
        },
        startup: {
          ready: () => {
            if ((window as any).MathJax?.startup?.defaultReady) {
              (window as any).MathJax.startup.defaultReady();
            }
            resolve();
          }
        },
        tex: {
          inlineMath: [['$', '$'], ['\\(', '\\)']],
          displayMath: [['$$', '$$'], ['\\[', '\\]']],
          processEscapes: true,
          packages: ['base', 'ams', 'noerrors', 'noundefined', 'autoload', 'physics'],
          macros: {
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\C": "\\mathbb{C}",
            "\\Q": "\\mathbb{Q}"
          }
        },
        svg: {
          fontCache: 'global'
        }
      };

      // Load MathJax script
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return mathJaxPromise;
};

/**
 * Add CSS styles for MathJax rendering
 */
const addStyles = () => {
  if (!isBrowser || document.getElementById('mathjax-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'mathjax-styles';
  style.innerHTML = `
    .math-container {
      font-size: 1.1em;
      overflow-x: auto;
      overflow-y: hidden;
    }
    
    .math-display {
      margin: 1.5em 0;
      padding: 0.5em;
      background: var(--accent);
      border-radius: 6px;
      display: flex;
      justify-content: center;
      min-height: 2.5em;
    }
    
    .math-inline {
      background: rgba(0, 0, 0, 0.03);
      border-radius: 4px;
      padding: 0.15em 0.3em;
      margin: 0 0.1em;
      display: inline-flex;
      align-items: center;
    }
    
    [data-theme="dark"] .mjx-math {
      color: #e5e5e5 !important;
    }
    
    [data-theme="dark"] svg.MathJax {
      filter: brightness(0.9) invert(0.9);
    }
    
    /* Loading dots */
    .math-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      padding: 8px;
    }
    
    .math-loading-dot {
      width: 6px;
      height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: math-loading-pulse 1.5s infinite ease-in-out;
    }
    
    .math-loading-dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .math-loading-dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes math-loading-pulse {
      0%, 100% {
        transform: scale(0.8);
        opacity: 0.5;
      }
      50% {
        transform: scale(1.2);
        opacity: 1;
      }
    }
    
    /* Error styling */
    .math-error {
      color: var(--destructive);
      border: 1px dashed var(--destructive);
      padding: 0.5rem;
      margin: 0.5rem 0;
      font-family: monospace;
      font-size: 0.9em;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `;
  
  document.head.appendChild(style);
};

// Function to standardize equation format (if it has mixed delimiters)
const standardizeEquation = (equation: string): string => {
  // If it already has dollar sign delimiters, return as is
  if (equation.startsWith('$') && equation.endsWith('$')) {
    return equation;
  }
  
  // If it has TeX delimiters, convert to dollar sign format
  if (equation.startsWith('\\(') && equation.endsWith('\\)')) {
    return '$' + equation.slice(2, -2) + '$';
  }
  
  if (equation.startsWith('\\[') && equation.endsWith('\\]')) {
    return '$$' + equation.slice(2, -2) + '$$';
  }
  
  // Otherwise, just return as is
  return equation;
};

/**
 * MathJaxEquation component
 * 
 * A component to render LaTeX equations using MathJax.
 * Uses a unique key approach with props in state to avoid DOM conflicts.
 */
export const MathJaxEquation = React.memo(function MathJaxEquation({ 
  equation, 
  display = false 
}: MathJaxEquationProps) {
  // Standardize the equation format
  const standardizedEquation = useMemo(() => standardizeEquation(equation), [equation]);
  
  // Track loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  
  // Create a stable ID for this equation
  const id = useMemo(() => {
    // Create a key based on the equation content but truncated
    const base = standardizedEquation.slice(0, 15).replace(/\W/g, '');
    // Add a random suffix to ensure uniqueness
    const random = Math.floor(Math.random() * 10000).toString(36);
    return `math-${display ? 'block' : 'inline'}-${base}-${random}`;
  }, [standardizedEquation, display]);
  
  // Add styles once
  useEffect(() => {
    addStyles();
  }, []);
  
  // Render equation when component mounts or equation changes
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setRenderedHtml('');
    
    let isMounted = true;
    
    const renderEquation = async () => {
      try {
        // Load MathJax
        await loadMathJax();
        
        // If no longer mounted, skip rendering
        if (!isMounted || !window) return;
        
        // Get MathJax instance
        const MathJax = (window as any).MathJax;
        if (!MathJax) {
          throw new Error('MathJax failed to load');
        }
        
        // Determine the LaTeX format for the equation
        // Always use dollar sign format for consistency
        const eqText = display 
          ? `$$${standardizedEquation.replace(/^\$\$|\$\$$|^\\\[|\\\]$/g, '')}$$` 
          : `$${standardizedEquation.replace(/^\$|\$$|^\\\(|\\\)$/g, '')}$`;
        
        // Use a safer approach with string manipulation 
        // instead of direct DOM manipulation
        const container = document.createElement('div');
        container.style.visibility = 'hidden';
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.innerHTML = eqText;
        document.body.appendChild(container);
        
        try {
          // Typeset the equation
          await MathJax.typesetPromise([container]);
          
          if (isMounted) {
            // Get rendered HTML
            const html = container.innerHTML;
            
            // Update state
            setRenderedHtml(html);
            setIsLoading(false);
          }
        } catch (renderError: any) {
          console.error('MathJax rendering error:', renderError);
          if (isMounted) {
            setError(renderError?.message || 'Failed to render equation');
            setIsLoading(false);
          }
        } finally {
          // Clean up
          document.body.removeChild(container);
        }
      } catch (err: any) {
        console.error('Error rendering math:', err);
        if (isMounted) {
          setError(err?.message || 'Failed to render math equation');
          setIsLoading(false);
        }
      }
    };
    
    // Slight delay before rendering to give streaming content time to settle
    const timeoutId = setTimeout(renderEquation, 50);
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [standardizedEquation, display]);
  
  // Display LoadingDots component during loading
  if (isLoading) {
    if (display) {
      return (
        <div className="math-container math-display" id={id}>
          <div className="math-loading">
            <span className="math-loading-dot"></span>
            <span className="math-loading-dot"></span>
            <span className="math-loading-dot"></span>
          </div>
        </div>
      );
    } else {
      return (
        <span className="math-container math-inline" id={id}>
          <span className="math-loading">
            <span className="math-loading-dot"></span>
            <span className="math-loading-dot"></span>
            <span className="math-loading-dot"></span>
          </span>
        </span>
      );
    }
  }
  
  // Display error message
  if (error) {
    if (display) {
      return (
        <div className="math-container math-display math-error" id={id}>
          {standardizedEquation}
          <div>Error: {error}</div>
        </div>
      );
    } else {
      return (
        <span className="math-container math-inline math-error" id={id}>
          {standardizedEquation}
        </span>
      );
    }
  }
  
  // Render the equation using dangerouslySetInnerHTML
  // This is safe because we've controlled what MathJax generated
  if (display) {
    return (
      <div 
        id={id}
        className="math-container math-display"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  } else {
    return (
      <span 
        id={id}
        className="math-container math-inline"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    );
  }
});

export default MathJaxEquation; 