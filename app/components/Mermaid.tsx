import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Download, FileDown } from 'lucide-react';

interface MermaidProps {
  chart: string;
  onMermaidClick?: (chart: string, title?: string) => void;
  title?: string;
  isModal?: boolean;
  isStreaming?: boolean; // 스트리밍 상태 추가
  showMobileUI?: boolean; // 모바일 UI 표시 상태
}

const MermaidDiagram = ({ chart, onMermaidClick, title, isModal = false, isStreaming = false, showMobileUI = false }: MermaidProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { theme } = useTheme();

  // Pan state for modal view
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Mouse event handlers for pan functionality (modal only)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isModal) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isModal || !isDragging || !dragStart) return;
    
    e.preventDefault();
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    if (!isModal) return;
    
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseLeave = () => {
    if (!isModal) return;
    
    setIsDragging(false);
    setDragStart(null);
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isModal || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - panPosition.x, y: touch.clientY - panPosition.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isModal || !isDragging || !dragStart || e.touches.length !== 1) return;
    
    e.preventDefault(); // Prevent scroll
    const touch = e.touches[0];
    setPanPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    if (!isModal) return;
    
    setIsDragging(false);
    setDragStart(null);
  };

  const handleTouchCancel = () => {
    if (!isModal) return;
    
    setIsDragging(false);
    setDragStart(null);
  };

  // Download functions
  const downloadAsPNG = async () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    
    try {
      // Convert SVG to PNG using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a');
            link.download = `mermaid-diagram-${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
          }
          URL.revokeObjectURL(url);
        });
      };
      img.src = url;
    } catch (error) {
      console.error('Failed to download PNG:', error);
    }
  };

  const downloadAsSVG = async () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    
    try {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `mermaid-diagram-${Date.now()}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download SVG:', error);
    }
  };

  // Mermaid 문법 검증 함수
  const validateMermaidSyntax = (chart: string): { isValid: boolean; error?: string } => {
    if (!chart.trim()) {
      return { isValid: false, error: 'Empty diagram' };
    }

    // 기본 다이어그램 타입 확인
    const diagramTypes = ['graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie', 'gitgraph', 'mindmap', 'timeline'];
    const hasValidType = diagramTypes.some(type => chart.trim().startsWith(type));
    
    if (!hasValidType) {
      return { isValid: false, error: 'Missing diagram type declaration' };
    }

    // 괄호 균형 확인
    const openBrackets = (chart.match(/\[/g) || []).length;
    const closeBrackets = (chart.match(/\]/g) || []).length;
    const openParens = (chart.match(/\(/g) || []).length;
    const closeParens = (chart.match(/\)/g) || []).length;

    if (openBrackets !== closeBrackets) {
      return { isValid: false, error: 'Unbalanced brackets []' };
    }
    if (openParens !== closeParens) {
      return { isValid: false, error: 'Unbalanced parentheses ()' };
    }

    return { isValid: true };
  };

  useEffect(() => {
    const renderChart = async () => {
      if (!chart || !containerRef.current) {
        setIsLoading(false);
        return;
      }

      // 스트리밍 중에는 렌더링하지 않음
      if (isStreaming) {
        setIsLoading(true);
        return;
      }

      // 문법 검증
      const validation = validateMermaidSyntax(chart);
      if (!validation.isValid) {
        setHasError(true);
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
            fontFamily: "Pretendard, 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
  }, [chart, theme, isStreaming]);

  // 스트리밍 중일 때 표시
  if (isStreaming) {
    return (
      <div className={`my-6 p-4 bg-[var(--background)] border border-[var(--subtle-divider)] rounded-lg shadow-md flex justify-center items-center relative min-h-[100px]`}>
        <div className="flex items-center space-x-2 text-[var(--muted)]">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--muted)]"></div>
          <span className="text-sm">Generating diagram...</span>
        </div>
      </div>
    );
  }


  if (hasError) {
    const validation = validateMermaidSyntax(chart);
    return (
      <div className="my-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
        <p className="text-red-600 dark:text-red-400 font-semibold">Mermaid Chart Error</p>
        <p className="text-red-500 dark:text-red-400 text-sm mt-1">
          {validation.error ? `Syntax Error: ${validation.error}` : 'Failed to render Mermaid chart. Please check the syntax.'}
        </p>
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Original Mermaid Code:</p>
          <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">{chart}</pre>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={`mermaid-container ${
        isModal 
          ? 'w-full h-full flex justify-center items-center overflow-hidden' 
          : 'my-6 p-4 bg-[var(--background)] border border-[var(--subtle-divider)] rounded-lg shadow-md flex justify-center items-center relative min-h-[100px] cursor-pointer hover:bg-[var(--accent)] transition-colors'
      }`}
      onClick={() => !isModal && onMermaidClick?.(chart, title)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      style={{
        cursor: isModal ? (isDragging ? 'grabbing' : 'grab') : undefined,
        touchAction: isModal ? 'none' : undefined
      }}
    >
      {/* Download buttons for modal view */}
      {isModal && !isLoading && !hasError && showMobileUI && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          <button
            onClick={downloadAsPNG}
            className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Download as PNG"
          >
            <Download size={20} />
          </button>
          <button
            onClick={downloadAsSVG}
            className="p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Download as SVG"
          >
            <FileDown size={20} />
          </button>
        </div>
      )}
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
        style={isModal ? {
          transform: `translate(${panPosition.x}px, ${panPosition.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        } : undefined}
      />
    </div>
  );
};

export default MermaidDiagram;