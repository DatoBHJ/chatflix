import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

interface MermaidProps {
  chart: string;
  onMermaidClick?: (chart: string, title?: string) => void;
  title?: string;
  isModal?: boolean;
}

const MermaidDiagram = ({ chart, onMermaidClick, title, isModal = false }: MermaidProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const renderChart = async () => {
      if (!chart || !containerRef.current) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setHasError(false);

      try {
        const mermaid = (await import('mermaid')).default;
        
        // Read CSS variables from the DOM to ensure theme consistency
        const computedStyle = getComputedStyle(document.documentElement);
        const background = computedStyle.getPropertyValue('--background').trim();
        const foreground = computedStyle.getPropertyValue('--foreground').trim();
        const fontFamily = computedStyle.getPropertyValue('--font-sans').trim();
        
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base', // Use 'base' theme to apply custom themeVariables
          securityLevel: 'loose',
          themeVariables: {
            // Background and text colors only
            background: background,
            textColor: foreground,
            fontFamily: fontFamily,
          }
        });

        const id = `mermaid-svg-${Math.random().toString(36).substring(2, 9)}`;
        const { svg, bindFunctions } = await mermaid.render(id, chart);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          if (bindFunctions) {
            bindFunctions(containerRef.current);
          }
        }
      } catch (error) {
        console.error('Failed to render mermaid chart:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart, theme]);

  if (hasError) {
    return (
      <div className="my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
        <p className="text-red-600 dark:text-red-400 font-semibold">Mermaid Chart Error</p>
        <p className="text-red-500 dark:text-red-400 text-sm mt-1">
          Failed to render Mermaid chart. Please check the syntax.
        </p>
        <pre className="text-xs text-red-500 dark:text-red-400/80 mt-2 whitespace-pre-wrap bg-red-500/10 p-2 rounded">{chart}</pre>
      </div>
    );
  }
  
  return (
    <div 
      className={`mermaid-container ${
        isModal 
          ? 'w-full h-full flex justify-center items-center' 
          : 'my-6 p-4 bg-[var(--background)] border border-[var(--subtle-divider)] rounded-lg shadow-md flex justify-center items-center relative min-h-[100px] cursor-pointer hover:bg-[var(--accent)] transition-colors'
      }`}
      onClick={() => onMermaidClick?.(chart, title)}
    >
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center ${
          isModal ? 'bg-transparent' : 'bg-[var(--background)] rounded-lg'
        }`}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--muted)]"></div>
        </div>
      )}
      <div 
        ref={containerRef} 
        className={`mermaid ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300 w-full flex justify-center`} 
      />
    </div>
  );
};

export default MermaidDiagram;
